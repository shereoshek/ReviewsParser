<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Models\ParsingRequest;
use App\Models\Review;
use App\Services\Parsers\YandexMapsParser;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
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
        $parsingRequest = ParsingRequest::findOrFail($this->parsingRequestId);

        $parsingRequest->update([
            'status' => 'processing',
            'progress' => 10,
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
        ]);
    }

    public function failed(Throwable $exception): void
    {
        ParsingRequest::whereKey($this->parsingRequestId)->update([
            'status' => 'failed',
            'error' => $exception->getMessage(),
        ]);
    }
}