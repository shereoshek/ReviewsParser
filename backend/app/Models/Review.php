<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    protected $fillable = [
        'organization_id',
        'external_id',
        'author',
        'published_at',
        'text',
        'rating',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
