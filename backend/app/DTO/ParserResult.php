<?php

namespace App\DTO;

readonly class ParserResult
{
    /**
     * @param ReviewData[] $reviews
     */
    public function __construct(
        public OrganizationData $organization,
        public array $reviews,
    ) {
    }
}
