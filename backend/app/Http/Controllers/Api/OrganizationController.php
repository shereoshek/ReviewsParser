<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ParseOrganizationJob;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function parse(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
        ]);

        ParseOrganizationJob::dispatch($validated['url']);

        return response()->json([
            'message' => 'Organization parsing has been queued.',
        ], 202);
    }

    public function index(): JsonResponse
    {
        $organizations = Organization::query()
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $organizations,
        ]);
    }

    public function show(Organization $organization): JsonResponse
    {
        return response()->json([
            'data' => $organization,
        ]);
    }

    public function reviews(
        Request $request,
        Organization $organization
    ): JsonResponse {
        $reviews = $organization->reviews()
            ->orderByDesc('published_at')
            ->paginate(50);

        return response()->json($reviews);
    }
}