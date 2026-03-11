'use client';

import React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function LanguageSelector() {
    const { language, setLanguage } = useLanguage();

    return (
        <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
            <SelectTrigger className="w-[140px] bg-white/90 backdrop-blur-sm border-gray-200 shadow-sm">
                <Globe className="h-4 w-4 text-gray-500" />
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
