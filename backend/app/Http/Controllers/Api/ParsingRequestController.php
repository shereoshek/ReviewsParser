<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ParsingRequest;
use Illuminate\Http\JsonResponse;

class ParsingRequestController extends Controller
{
    public function show(ParsingRequest $parsingRequest): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $parsingRequest->id,
                'status' => $parsingRequest->status,
                'progress' => $parsingRequest->progress,
                'error' => $parsingRequest->error,
                'organization_id' => $parsingRequest->organization_id,
            ],
        ]);
    }
}