<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Models\ParsingRequest;
use App\Models\Review;
use App\Services\Parsers\YandexMapsParser;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class ParseOrganizationJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $backoff = 25;

    public function __construct(
        public string $url,
        public int $parsingRequestId,
    ) {
    }

    public function handle(YandexMapsParser $parser): void
    {
        $parsingRequest = ParsingRequest::findOrFail(
            $this->parsingRequestId
        );

        $parsingRequest->update([
            'status' => 'processing',
            'progress' => 10,
            'error' => null,
        ]);

        $result = $parser->parse($this->url);

        $parsingRequest->update([
            'progress' => 70,
        ]);

        $organization = Organization::updateOrCreate(
            [
                'external_id' => $result->organization->externalId,
            ],
            [
                'name' => $result->organization->name,
                'url' => $result->organization->url,
                'rating' => $result->organization->rating,
                'ratings_count' => $result->organization->ratingsCount,
                'reviews_count' => $result->organization->reviewsCount,
            ],
        );

        $parsingRequest->update([
            'organization_id' => $organization->id,
            'progress' => 80,
        ]);

        foreach ($result->reviews as $reviewData) {
            Review::firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'author' => $reviewData->author,
                    'published_at' => $reviewData->publishedAt,
                    'text' => $reviewData->text,
                    'rating' => $reviewData->rating,
                ],
            );
        }

        $parsingRequest->update([
            'status' => 'completed',
            'progress' => 100,
            'error' => null,
        ]);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Organization parsing failed.', [
            'parsing_request_id' => $this->parsingRequestId,
            'url' => $this->url,
            'exception' => $exception,
        ]);

        $errorMessage = $this->getUserErrorMessage($exception);

        ParsingRequest::whereKey($this->parsingRequestId)->update([
            'status' => 'failed',
            'progress' => 0,
            'error' => $errorMessage,
        ]);
    }

    private function getUserErrorMessage(Throwable $exception): string
    {
        $message = $exception->getMessage();

        if (
            str_contains($message, 'ERR_NAME_NOT_RESOLVED') ||
            str_contains($message, 'ERR_CONNECTION') ||
            str_contains($message, 'ERR_TIMED_OUT') ||
            str_contains($message, 'timeout')
        ) {
            return 'Не удалось открыть страницу Yandex Maps. Проверьте ссылку и доступность страницы.';
        }

        if (
            str_contains($message, 'invalid JSON') ||
            str_contains($message, 'invalid organization data') ||
            str_contains($message, 'invalid reviews data') ||
            str_contains($message, 'has an invalid format')
        ) {
            return 'Не удалось обработать данные Yandex Maps. Возможно, структура страницы изменилась.';
        }

        if (
            str_contains($message, 'empty response')
        ) {
            return 'Yandex Maps вернул пустой ответ. Попробуйте повторить парсинг позже.';
        }

        return 'Не удалось получить данные организации. Попробуйте проверить ссылку и повторить парсинг.';
    }
}