import { Value } from 'vega-lite/build/src/channeldef';
import { extractFormatFromChannelDef } from './parsers/extractFormat';
import extractScale, { ScaleAgent } from './parsers/extractScale';
import extractGetter from './parsers/extractGetter';
import { ChannelOptions, ChannelType, ChannelInput } from './types/Channel';
import { PlainObject } from './types/Data';
import {
  ChannelDef,
  isScaleFieldDef,
  isMarkPropFieldDef,
  isValueDef,
  isFieldDef,
  isNonValueDef,
  isTypedFieldDef,
} from './types/ChannelDef';
import isEnabled from './utils/isEnabled';
import isDisabled from './utils/isDisabled';
import identity from './utils/identity';
import AxisAgent from './AxisAgent';

export default class ChannelEncoder<Def extends ChannelDef<Output>, Output extends Value = Value> {
  readonly name: string | Symbol | number;
  readonly type: ChannelType;
  readonly definition: Def;
  readonly options: ChannelOptions;

  protected readonly getValue: (datum: PlainObject) => ChannelInput;
  readonly encodeValue: (value: ChannelInput) => Output | null | undefined;
  readonly formatValue: (value: ChannelInput | { toString(): string }) => string;
  readonly scale?: ScaleAgent<Output>;
  readonly axis?: AxisAgent<Def, Output>;

  constructor({
    name,
    type,
    definition,
    options = {},
  }: {
    name: string | Symbol | number;
    type: ChannelType;
    definition: Def;
    options?: ChannelOptions;
  }) {
    this.name = name;
    this.type = type;
    this.definition = definition;
    this.options = options;

    this.getValue = extractGetter(definition);
    this.formatValue = extractFormatFromChannelDef(definition);

    this.scale = extractScale(this.type, definition, options.namespace);
    // Has to extract axis after format and scale
    if (
      this.isXY() &&
      isNonValueDef(this.definition) &&
      (('axis' in this.definition && isEnabled(this.definition.axis)) ||
        !('axis' in this.definition))
    ) {
      this.axis = new AxisAgent<Def, Output>(this);
    }

    this.encodeValue = this.scale ? this.scale.encodeValue : identity;
    this.encode = this.encode.bind(this);
    this.format = this.format.bind(this);
    this.get = this.get.bind(this);
  }

  encode(datum: PlainObject): Output | null | undefined;
  // eslint-disable-next-line no-dupe-class-members
  encode(datum: PlainObject, otherwise: Output): Output;
  // eslint-disable-next-line no-dupe-class-members
  encode(datum: PlainObject, otherwise?: Output) {
    const value = this.get(datum);
    if (value === null || value === undefined) {
      return otherwise;
    }

    const output = this.encodeValue(value);

    return otherwise !== undefined && (output === null || output === undefined)
      ? otherwise
      : output;
  }

  format(datum: PlainObject): string {
    return this.formatValue(this.get(datum));
  }

  get<T extends ChannelInput>(datum: PlainObject, otherwise?: T) {
    const value = this.getValue(datum);

    return otherwise !== undefined && (value === null || value === undefined)
      ? otherwise
      : (value as T);
  }

  getTitle() {
    if (isFieldDef(this.definition)) {
      return this.definition.title || this.definition.field;
    }

    return '';
  }

  hasLegend() {
    if (isDisabled(this.options.legend) || this.isXY() || isValueDef(this.definition)) {
      return false;
    }
    if (isMarkPropFieldDef(this.definition)) {
      return isEnabled(this.definition.legend);
    }

    return isScaleFieldDef(this.definition);
  }

  isGroupBy() {
    if (isTypedFieldDef(this.definition)) {
      const { type: dataType } = this.definition;

      return (
        this.type === 'Category' ||
        this.type === 'Text' ||
        (this.type === 'Color' && (dataType === 'nominal' || dataType === 'ordinal')) ||
        (this.isXY() && (dataType === 'nominal' || dataType === 'ordinal'))
      );
    }

    return false;
  }

  isX() {
    return this.type === 'X' || this.type === 'XBand';
  }

  isXY() {
    return this.type === 'X' || this.type === 'Y' || this.type === 'XBand' || this.type === 'YBand';
  }

  isY() {
    return this.type === 'Y' || this.type === 'YBand';
  }
}
