<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    protected $fillable = [
        'external_id',
        'name',
        'url',
        'rating',
        'ratings_count',
        'reviews_count',
    ];

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }
}
