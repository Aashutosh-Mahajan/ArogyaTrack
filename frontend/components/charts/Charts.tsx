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

export function LineChartComponent({ data, dataKey, xAxisKey, color = '#0ea5e9' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color} 
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaChartComponent({ data, dataKey, xAxisKey, color = '#0ea5e9' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color}
          fill={color}
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarChartComponent({ data, dataKey, xAxisKey, color = '#0ea5e9' }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={dataKey} fill={color} />
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
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
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
          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
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
          stroke="#94a3b8"
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
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="4 3"
          dot={false}
          name="Confidence Band"
        />
        {/* Forecast line (on top) */}
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={data.length <= 14 ? { r: 3, fill: '#10b981' } : false}
          activeDot={{ r: 5 }}
          name="Forecast"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
