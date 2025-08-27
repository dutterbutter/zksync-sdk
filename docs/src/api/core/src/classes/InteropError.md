[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / InteropError

# Class: InteropError

Defined in: [packages/core/src/errors.ts:11](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/errors.ts#L11)

## Extends

- `Error`

## Constructors

### Constructor

> **new InteropError**(`code`, `message`, `details?`): `InteropError`

Defined in: [packages/core/src/errors.ts:16](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/errors.ts#L16)

#### Parameters

##### code

[`InteropErrorCode`](../type-aliases/InteropErrorCode.md)

##### message

`string`

##### details?

[`InteropErrorDetails`](../type-aliases/InteropErrorDetails.md)

#### Returns

`InteropError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

Defined in: [packages/core/src/errors.ts:14](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/errors.ts#L14)

The cause of the error.

#### Overrides

`Error.cause`

---

### code

> **code**: [`InteropErrorCode`](../type-aliases/InteropErrorCode.md)

Defined in: [packages/core/src/errors.ts:12](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/errors.ts#L12)

---

### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [packages/core/src/errors.ts:13](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/errors.ts#L13)

---

### message

> **message**: `string`

Defined in: node_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

---

### name

> **name**: `string`

Defined in: node_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

---

### stack?

> `optional` **stack**: `string`

Defined in: node_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

---

### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Defined in: node_modules/@types/node/globals.d.ts:143

Optional override for formatting stack traces

#### Parameters

##### err

`Error`

##### stackTraces

`CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

`Error.prepareStackTrace`

---

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

Defined in: node_modules/bun-types/globals.d.ts:990

The maximum number of stack frames to capture.

#### Inherited from

`Error.stackTraceLimit`

## Methods

### captureStackTrace()

#### Call Signature

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node_modules/bun-types/globals.d.ts:985

Create .stack property on a target object

##### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

##### Returns

`void`

##### Inherited from

`Error.captureStackTrace`

#### Call Signature

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node_modules/@types/node/globals.d.ts:136

Create .stack property on a target object

##### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

##### Returns

`void`

##### Inherited from

`Error.captureStackTrace`

---

### isError()

#### Call Signature

> `static` **isError**(`error`): `error is Error`

Defined in: node_modules/typescript/lib/lib.esnext.error.d.ts:23

Indicates whether the argument provided is a built-in Error instance or not.

##### Parameters

###### error

`unknown`

##### Returns

`error is Error`

##### Inherited from

`Error.isError`

#### Call Signature

> `static` **isError**(`value`): `value is Error`

Defined in: node_modules/bun-types/globals.d.ts:980

Check if a value is an instance of Error

##### Parameters

###### value

`unknown`

The value to check

##### Returns

`value is Error`

True if the value is an instance of Error, false otherwise

##### Inherited from

`Error.isError`
