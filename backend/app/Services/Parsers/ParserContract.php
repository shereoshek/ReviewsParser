<?php

namespace App\Services\Parsers;

interface ParserContract
{
    public function parse(string $url);
}