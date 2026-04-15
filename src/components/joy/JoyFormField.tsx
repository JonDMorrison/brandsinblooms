import * as React from "react";
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";

type JoyFormFieldRenderProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  error: boolean;
  errorMessage?: string;
  commonProps: {
    name: string;
    disabled?: boolean;
    required: boolean;
    error: boolean;
    errorMessage?: string;
  };
  inputProps: {
    ref: ControllerRenderProps<TFieldValues, TName>["ref"];
    name: string;
    disabled?: boolean;
    value: string;
    onBlur: ControllerRenderProps<TFieldValues, TName>["onBlur"];
    onValueChange: (value: string) => void;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    error: boolean;
    errorMessage?: string;
  };
  textareaProps: {
    ref: ControllerRenderProps<TFieldValues, TName>["ref"];
    name: string;
    disabled?: boolean;
    value: string;
    onBlur: ControllerRenderProps<TFieldValues, TName>["onBlur"];
    onValueChange: (value: string) => void;
    onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
    error: boolean;
    errorMessage?: string;
  };
  selectProps: {
    ref: ControllerRenderProps<TFieldValues, TName>["ref"];
    name: string;
    disabled?: boolean;
    value: string;
    onBlur: ControllerRenderProps<TFieldValues, TName>["onBlur"];
    onValueChange: (value: string) => void;
    error: boolean;
    errorMessage?: string;
  };
  autocompleteProps: {
    ref: ControllerRenderProps<TFieldValues, TName>["ref"];
    name: string;
    disabled?: boolean;
    value: FieldPathValue<TFieldValues, TName> | null;
    onBlur: ControllerRenderProps<TFieldValues, TName>["onBlur"];
    onValueChange: (value: FieldPathValue<TFieldValues, TName> | null) => void;
    error: boolean;
    errorMessage?: string;
  };
  switchProps: {
    ref: ControllerRenderProps<TFieldValues, TName>["ref"];
    name: string;
    disabled?: boolean;
    checked: boolean;
    onBlur: ControllerRenderProps<TFieldValues, TName>["onBlur"];
    onCheckedChange: (checked: boolean) => void;
  };
  checkboxProps: {
    ref: ControllerRenderProps<TFieldValues, TName>["ref"];
    name: string;
    disabled?: boolean;
    checked: boolean;
    onBlur: ControllerRenderProps<TFieldValues, TName>["onBlur"];
    onCheckedChange: (checked: boolean) => void;
  };
};

export interface JoyFormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  name: TName;
  control: Control<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, TName>;
  defaultValue?: FieldPathValue<TFieldValues, TName>;
  disabled?: boolean;
  render: (
    props: JoyFormFieldRenderProps<TFieldValues, TName>,
  ) => React.ReactNode;
}

const isRequiredRule = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  rules?: RegisterOptions<TFieldValues, TName>,
) => Boolean(rules?.required);

const asString = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

export function JoyFormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  name,
  control,
  rules,
  defaultValue,
  disabled,
  render,
}: JoyFormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      defaultValue={defaultValue}
      render={({ field, fieldState }) => {
        const error = Boolean(fieldState.error);
        const errorMessage = fieldState.error?.message;
        const required = isRequiredRule(rules);
        const stringValue = asString(field.value);

        return render({
          field,
          fieldState,
          error,
          errorMessage,
          commonProps: {
            name: field.name,
            disabled,
            required,
            error,
            errorMessage,
          },
          inputProps: {
            ref: field.ref,
            name: field.name,
            disabled,
            value: stringValue,
            onBlur: field.onBlur,
            onValueChange: field.onChange,
            onChange: (event) => field.onChange(event.target.value),
            error,
            errorMessage,
          },
          textareaProps: {
            ref: field.ref,
            name: field.name,
            disabled,
            value: stringValue,
            onBlur: field.onBlur,
            onValueChange: field.onChange,
            onChange: (event) => field.onChange(event.target.value),
            error,
            errorMessage,
          },
          selectProps: {
            ref: field.ref,
            name: field.name,
            disabled,
            value: stringValue,
            onBlur: field.onBlur,
            onValueChange: field.onChange,
            error,
            errorMessage,
          },
          autocompleteProps: {
            ref: field.ref,
            name: field.name,
            disabled,
            value: (field.value ?? null) as FieldPathValue<
              TFieldValues,
              TName
            > | null,
            onBlur: field.onBlur,
            onValueChange: field.onChange,
            error,
            errorMessage,
          },
          switchProps: {
            ref: field.ref,
            name: field.name,
            disabled,
            checked: Boolean(field.value),
            onBlur: field.onBlur,
            onCheckedChange: field.onChange,
          },
          checkboxProps: {
            ref: field.ref,
            name: field.name,
            disabled,
            checked: Boolean(field.value),
            onBlur: field.onBlur,
            onCheckedChange: field.onChange,
          },
        });
      }}
    />
  );
}
