<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Models\Review;
use App\Services\Parsers\YandexMapsParser;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ParseOrganizationJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $backoff = 25;

    public function __construct(
        public string $url,
    ) {
    }

    public function handle(YandexMapsParser $parser): void
    {
        $result = $parser->parse($this->url);

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
    }
}