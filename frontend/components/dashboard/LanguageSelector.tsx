'use client';

import React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function LanguageSelector() {
    const { language, setLanguage } = useLanguage();

    return (
        <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
            <SelectTrigger className="w-[120px] bg-white/90 backdrop-blur-sm border-gray-200 shadow-sm">
                <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="mr">मराठी (Marathi)</SelectItem>
            </SelectContent>
        </Select>
    );
}
