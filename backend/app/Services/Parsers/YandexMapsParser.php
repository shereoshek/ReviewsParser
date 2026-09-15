<?php

namespace App\Services\Parsers;

use App\DTO\OrganizationData;
use App\DTO\ParserResult;
use App\DTO\ReviewData;
use Carbon\Carbon;
use Symfony\Component\Process\Process;
use Throwable;

class YandexMapsParser implements ParserContract
{
    public function parse(string $url): ParserResult
    {
        $process = new Process([
            'node',
            base_path('scripts/yandex-maps-parser.js'),
            $url,
        ]);

        $process->setTimeout(180);

        try {
            $process->run();
        } catch (Throwable $e) {
            throw new \RuntimeException(
                'Failed to start Yandex Maps parser: ' . $e->getMessage(),
                0,
                $e
            );
        }

        if (!$process->isSuccessful()) {
            $error = trim($process->getErrorOutput());

            throw new \RuntimeException(
                $error !== ''
                    ? $error
                    : 'Yandex Maps parser failed.'
            );
        }

        $output = trim($process->getOutput());

        if ($output === '') {
            throw new \RuntimeException(
                'Yandex Maps parser returned an empty response.'
            );
        }

        try {
            $data = json_decode(
                $output,
                true,
                512,
                JSON_THROW_ON_ERROR
            );
        } catch (\JsonException $e) {
            throw new \RuntimeException(
                'Yandex Maps parser returned invalid JSON: ' .
                $e->getMessage(),
                0,
                $e
            );
        }

        if (
            !isset($data['organization']) ||
            !is_array($data['organization'])
        ) {
            throw new \RuntimeException(
                'Yandex Maps parser returned invalid organization data.'
            );
        }

        if (
            !isset($data['reviews']) ||
            !is_array($data['reviews'])
        ) {
            throw new \RuntimeException(
                'Yandex Maps parser returned invalid reviews data.'
            );
        }

        $organization = $data['organization'];

        $organizationData = new OrganizationData(
            externalId: $organization['externalId'],
            name: $organization['name'],
            url: $url,
            rating: $organization['rating'] ?? null,
            ratingsCount: $organization['ratingsCount'],
            reviewsCount: $organization['reviewsCount'],
        );

        $reviews = [];

        foreach ($data['reviews'] as $index => $review) {
            if (!is_array($review)) {
                throw new \RuntimeException(
                    'Review #' . ($index + 1) . ' has an invalid format.'
                );
            }

            try {
                $publishedAt = isset($review['publishedAt'])
                    ? Carbon::parse($review['publishedAt'])
                    : null;
            } catch (Throwable $e) {
                throw new \RuntimeException(
                    "Review #" . ($index + 1) .
                    " has an invalid publication date.",
                    0,
                    $e
                );
            }

            $reviews[] = new ReviewData(
                author: $review['author'],
                publishedAt: $publishedAt,
                text: $review['text'],
                rating: $review['rating'],
            );
        }

        return new ParserResult(
            organization: $organizationData,
            reviews: $reviews,
        );
    }
}