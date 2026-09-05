import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { WeekTrendItem } from '@shared/api.interface';

interface StatsTrendChartProps {
  trend: WeekTrendItem[];
}

const NEW_COLOR = '#4f46e5';
const REVIEW_COLOR = '#f59e0b';

const StatsTrendChart: React.FC<StatsTrendChartProps> = ({ trend }) => {
  const dates: string[] = trend.map((item: WeekTrendItem) =>
    item.date.slice(5),
  );
  const newCounts: number[] = trend.map((item: WeekTrendItem) => item.newCount);
  const reviewCounts: number[] = trend.map(
    (item: WeekTrendItem) => item.reviewCount,
  );

  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: dates,
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '新学单词',
        type: 'bar',
        data: newCounts,
        itemStyle: { color: NEW_COLOR, borderRadius: 4 },
        barMaxWidth: 28,
      },
      {
        name: '复习单词',
        type: 'line',
        data: reviewCounts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: REVIEW_COLOR },
        lineStyle: { color: REVIEW_COLOR, width: 2 },
      },
    ],
  };

  return <ReactECharts option={option} theme="ud" className="h-[300px] w-full" />;
};

export default StatsTrendChart;
