<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ParsingRequest extends Model
{
    protected $fillable = [
        'url',
        'organization_id',
        'status',
        'progress',
        'error',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}