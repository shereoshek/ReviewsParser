<?php

namespace App\DTO;

readonly class OrganizationData
{
    public function __construct(
        public string $externalId,
        public string $name,
        public string $url,
        public ?float $rating,
        public int $ratingsCount,
        public int $reviewsCount,
    ) {}
}
