<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ParsingRequest;
use Illuminate\Http\JsonResponse;

class ParsingRequestController extends Controller
{
    public function show(ParsingRequest $parsingRequest): JsonResponse
    {
        $message = match ($parsingRequest->status) {
            'pending' => 'Parsing request is waiting to be processed.',
            'processing' => 'Organization parsing is in progress.',
            'completed' => 'Organization parsing completed successfully.',
            'failed' => 'Organization parsing failed.',
            default => 'Unknown parsing request status.',
        };

        return response()->json([
            'data' => [
                'id' => $parsingRequest->id,
                'status' => $parsingRequest->status,
                'progress' => $parsingRequest->progress,
                'message' => $message,
                'error' => $parsingRequest->error,
                'organization_id' => $parsingRequest->organization_id,
            ],
        ]);
    }
}