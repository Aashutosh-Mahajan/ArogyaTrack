'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartProps {
  data: any[];
  dataKey: string;
  xAxisKey: string;
  title?: string;
  color?: string;
}

export function LineChartComponent({ data, dataKey, xAxisKey, color = '#1FA7A0' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
        <Legend />
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color} 
          strokeWidth={2.5}
          dot={{ r: 4, fill: color }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaChartComponent({ data, dataKey, xAxisKey, color = '#1FA7A0' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
        <Legend />
        <Area 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color}
          fill="url(#areaGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarChartComponent({ data, dataKey, xAxisKey, color = '#1FA7A0' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
        <Legend />
        <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ForecastChartProps {
  data: Array<{
    date: string;
    forecast: number;
    lower_bound: number;
    upper_bound: number;
    confidence?: number;
    regions?: number;
  }>;
}

export function ForecastChart({ data }: ForecastChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1FA7A0" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1FA7A0" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          interval={data.length > 14 ? Math.floor(data.length / 7) : 0}
          angle={data.length > 14 ? -35 : 0}
          textAnchor={data.length > 14 ? 'end' : 'middle'}
          height={data.length > 14 ? 50 : 30}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ borderRadius: '16px', fontSize: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
          formatter={(value: number, name: string) => [
            typeof value === 'number' ? value.toFixed(1) : value,
            name,
          ]}
        />
        <Legend />
        {/* Upper bound area (filled) */}
        <Area
          type="monotone"
          dataKey="upper_bound"
          fill="url(#forecastGradient)"
          stroke="none"
          name="Upper Bound"
          isAnimationActive={false}
        />
        {/* Lower bound area (white fill to carve out the band) */}
        <Area
          type="monotone"
          dataKey="lower_bound"
          fill="#ffffff"
          stroke="none"
          name="Lower Bound"
          isAnimationActive={false}
          legendType="none"
        />
        {/* Lower bound line */}
        <Line
          type="monotone"
          dataKey="lower_bound"
          stroke="#8A9A9A"
          strokeWidth={1}
          strokeDasharray="4 3"
          dot={false}
          name="Lower Bound"
          legendType="none"
        />
        {/* Upper bound line */}
        <Line
          type="monotone"
          dataKey="upper_bound"
          stroke="#8A9A9A"
          strokeWidth={1}
          strokeDasharray="4 3"
          dot={false}
          name="Confidence Band"
        />
        {/* Forecast line (on top) */}
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#0F5C5C"
          strokeWidth={2.5}
          dot={data.length <= 14 ? { r: 3, fill: '#0F5C5C' } : false}
          activeDot={{ r: 5 }}
          name="Forecast"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
