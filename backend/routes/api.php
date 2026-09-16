<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\ParsingRequestController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    /**
     * Организации получение, отправка и прочее
     */
    Route::post('/organizations/parse', [OrganizationController::class, 'parse']);

    Route::get('/organizations', [OrganizationController::class, 'index']);

    Route::get('/organizations/{organization}', [OrganizationController::class, 'show']);

    Route::get('/organizations/{organization}/reviews',[OrganizationController::class, 'reviews']);
    
    Route::get('/parsing-requests/{parsingRequest}',[ParsingRequestController::class, 'show']); //Статус бар

});