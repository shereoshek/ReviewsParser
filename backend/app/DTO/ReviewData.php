<?php

namespace App\DTO;

use Carbon\Carbon;

readonly class ReviewData
{
    public function __construct(
        public string $author,
        public ?Carbon $publishedAt,
        public string $text,
        public int $rating,
    ) {
    }
}