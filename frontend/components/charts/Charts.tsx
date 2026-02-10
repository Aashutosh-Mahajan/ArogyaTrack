'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  data: any[];
}

export function ForecastChart({ data }: ForecastChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="actual" 
          stroke="#0ea5e9" 
          strokeWidth={2}
          name="Actual Cases"
        />
        <Line 
          type="monotone" 
          dataKey="forecast" 
          stroke="#10b981" 
          strokeWidth={2}
          strokeDasharray="5 5"
          name="Forecast"
        />
        <Line 
          type="monotone" 
          dataKey="lowerBound" 
          stroke="#94a3b8" 
          strokeWidth={1}
          strokeDasharray="3 3"
          name="Lower Bound"
        />
        <Line 
          type="monotone" 
          dataKey="upperBound" 
          stroke="#94a3b8" 
          strokeWidth={1}
          strokeDasharray="3 3"
          name="Upper Bound"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
