import cloneDeep from 'lodash/cloneDeep'
import * as ObjectHash from 'object-hash'

export type TransformFunction<S> = (snap: S, data?: any) => S
export interface TransformFunctions<S> { [s: string]: TransformFunction<S> }
export interface TransOperation {
  name: string
  data?: any
  timestamp: number
  hash: string
}
export type TransOperationOption = {
  name: string
  data?: any
  timestamp?: number
} | string
export interface SnapshotCache<S> {
  get(key: string): S
  set(key: string, snap: S, ttl?: number): void
}

export class BasicCache<S> implements SnapshotCache<S> {
  _cache: {[key: string]: S}
  constructor (cache: {[key: string]: S} = {}) {
    this._cache = cache
  }
  get (key: string): S {
    return this._cache[key]
  }
  set (key: string, snap: S): void {
    this._cache[key] = snap
  }
}

export function TreeHash (
  operations: TransOperation[],
  baseHash: string,
  operationIndex: number,
  hashFunction = ObjectHash.sha1,
) {
  const operationHashes = operations
    .slice(0, operationIndex)
    .map(op => op.hash)
  return hashFunction({
    baseHash,
    operations: operationHashes,
  })
}

export function EvalTransforms<S> (
  transforms: TransformFunctions<S>,
  hashFunction = ObjectHash.sha1,
  cacheObject?: SnapshotCache<S>,
  cacheTTL?: number
) {
  return (
    base: S,
    operations: TransOperation[],
  ) => {
    let snap = base
    const baseHash = hashFunction(base)
    let snapIndex = 0
    const treeHash = (index: number) => TreeHash(operations, baseHash, index, hashFunction)

    if (cacheObject) {
      // search revere
      for (let index = operations.length; index >= 0; index -= 1) {
        const hash = treeHash(index)
        if (cacheObject.get(hash)) {
          snap = cacheObject.get(hash)
          snapIndex = index
          break
        }
      }
    }

    for (let index = snapIndex; index < operations.length; index += 1) {
      const operation = operations[index]
      const result = transforms[operation.name](cloneDeep(snap), operation.data)
      const hash = treeHash(index + 1)
      if (cacheObject)
        cacheObject.set(hash, Object.freeze(result), cacheTTL)

      snap = result
    }
    return snap
  }
}

export function ProcessOperations (operations: TransOperationOption[], hashFunction = ObjectHash.sha1): TransOperation[] {
  return operations.map(operation => {
    if (typeof operation === 'string') {
      return {
        name: operation,
        timestamp: +new Date(),
        hash: hashFunction({ action: operation }),
      }
    }
    else {
      return {
        name: operation.name,
        data: Object.freeze(operation.data),
        timestamp: operation.timestamp || +new Date(),
        hash: hashFunction({ action: operation.name, data: operation.data }),
      }
    }
  })
}

export function ProcessOperation (operation: TransOperationOption, hashFunction = ObjectHash.sha1): TransOperation {
  return ProcessOperations([operation])[0]
}

export default class OperationChain<S> {
  base: Readonly<S>
  baseHash: string
  operations: TransOperation[]
  transforms: TransformFunctions<S>
  cache: SnapshotCache<S>

  constructor (baseSnapshot: S, transforms: TransformFunctions<S>, operations: TransOperationOption[] = []) {
    this.base = Object.freeze(baseSnapshot)
    this.baseHash = this.objectHash(this.base)
    this.transforms = transforms
    this.operations = []
    this.insertOperations(operations)
    this.cache = new BasicCache<S>()
  }

  objectHash (object: any) {
    return ObjectHash.sha1(object)
  }

  insertOperation (operation: TransOperationOption) {
    this.insertOperations([operation])
  }

  insertOperations (operations: TransOperationOption[]) {
    const processed = ProcessOperations(operations, this.objectHash)
    this.operations = this.operations.concat(processed).sort((a, b) => a.timestamp - b.timestamp)
  }

  eval (cache = true) {
    return EvalTransforms(
      this.transforms,
      this.objectHash,
      cache ? this.cache : undefined,
    )(
      this.base,
      this.operations,
    )
  }
}
