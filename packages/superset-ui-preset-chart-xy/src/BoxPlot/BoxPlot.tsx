/* eslint-disable sort-keys, no-magic-numbers, complexity */
import React from 'react';
import { BoxPlotSeries, XYChart } from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { Margin, Dimension } from '@superset-ui/dimension';
import { WithLegend } from '@superset-ui/chart-composition';
import { createSelector } from 'reselect';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';
import ChartLegend from '../components/legend/ChartLegend';
import Encoder, { ChannelTypes, Encoding, Outputs } from './Encoder';
import { Dataset, PlainObject } from '../encodeable/types/Data';
import { PartialSpec } from '../encodeable/types/Specification';
import createMarginSelector, { DEFAULT_MARGIN } from '../utils/selectors/createMarginSelector';
import createXYChartLayoutSelector from '../utils/selectors/createXYChartLayoutSelector';
import { BoxPlotDataRow } from './types';
import convertScaleToDataUIScale from '../utils/convertScaleToDataUIScaleShape';

export interface TooltipProps {
  datum: BoxPlotDataRow;
  color: string;
  encoder: Encoder;
}

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer,
} as const;

export type HookProps = {
  TooltipRenderer?: React.ComponentType<TooltipProps>;
};

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  data: Dataset;
  theme?: ChartTheme;
} & PartialSpec<Encoding> &
  HookProps &
  Readonly<typeof defaultProps>;

export default class BoxPlot extends React.PureComponent<Props> {
  static defaultProps = defaultProps;

  encoder: Encoder;
  private createEncoder: () => void;

  private createMargin = createMarginSelector();

  private createXYChartLayout = createXYChartLayoutSelector();

  constructor(props: Props) {
    super(props);

    const createEncoder = createSelector(
      (p: PartialSpec<Encoding>) => p.encoding,
      p => p.commonEncoding,
      p => p.options,
      (encoding, commonEncoding, options) => new Encoder({ encoding, commonEncoding, options }),
    );

    this.createEncoder = () => {
      this.encoder = createEncoder(this.props);
    };

    this.encoder = createEncoder(this.props);
    this.renderChart = this.renderChart.bind(this);
  }

  renderChart(dim: Dimension) {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer } = this.props;
    const { channels } = this.encoder;

    const isHorizontal = channels.y.definition.type === 'nominal';

    const children = [
      <BoxPlotSeries
        key={channels.x.definition.field}
        animated
        data={
          isHorizontal
            ? data.map(row => ({ ...row, y: channels.y.get(row) }))
            : data.map(row => ({ ...row, x: channels.x.get(row) }))
        }
        fill={(datum: PlainObject) => channels.color.encode(datum, '#55acee')}
        fillOpacity={0.4}
        stroke={(datum: PlainObject) => channels.color.encode(datum)}
        strokeWidth={1}
        widthRatio={0.6}
        horizontal={channels.y.definition.type === 'nominal'}
      />,
    ];

    const layout = this.createXYChartLayout({
      width,
      height,
      margin: this.createMargin(margin),
      theme,
      xEncoder: channels.x,
      yEncoder: channels.y,
      children,
    });

    return layout.renderChartWithFrame((chartDim: Dimension) => (
      <XYChart
        width={chartDim.width}
        height={chartDim.height}
        ariaLabel="BoxPlot"
        margin={layout.margin}
        renderTooltip={({ datum, color }: { datum: BoxPlotDataRow; color: string }) => (
          <TooltipRenderer datum={datum} color={color} encoder={this.encoder} />
        )}
        showYGrid
        theme={theme}
        xScale={convertScaleToDataUIScale(channels.x.scale!.config)}
        yScale={convertScaleToDataUIScale(channels.y.scale!.config)}
      >
        {children}
        {layout.renderXAxis()}
        {layout.renderYAxis()}
      </XYChart>
    ));
  }

  render() {
    const { className, data, width, height } = this.props;

    this.createEncoder();
    const renderLegend = this.encoder.hasLegend()
      ? // eslint-disable-next-line react/jsx-props-no-multi-spaces
        () => <ChartLegend<ChannelTypes, Outputs, Encoding> data={data} encoder={this.encoder} />
      : undefined;

    return (
      <WithLegend
        className={`superset-chart-box-plot ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={renderLegend}
        renderChart={this.renderChart}
      />
    );
  }
}
