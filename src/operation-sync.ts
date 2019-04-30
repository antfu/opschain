import cloneDeep from 'lodash/cloneDeep'
import * as ObjectHash from 'object-hash'

export type TransformsData = Readonly<any> | string
export type TransformFunction<S> = (snap: S, data?: TransformsData) => S | Promise<S>
export interface TransformFunctions<S> { [s: string]: TransformFunction<S> }
export interface TransOperation {
  name: string
  data?: Readonly<any>
  timestamp: number
  hash: string
}
export type OperationOption = {
  name: string
  data?: any
  timestamp?: number
} | string
export interface SnapshotCache<S> { [hast: string]: Readonly<S> }

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

export async function EvalTransforms<S> (
  base: S,
  transforms: TransformFunctions<S>,
  operations: TransOperation[],
  hashFunction = ObjectHash.sha1,
  cacheObject?: SnapshotCache<S>,
) {
  let snap = base
  const baseHash = hashFunction(base)
  let snapIndex = 0
  const treeHash = (index: number) => TreeHash(operations, baseHash, index, hashFunction)

  if (cacheObject) {
    // search revere
    for (let index = operations.length; index >= 0; index -= 1) {
      const hash = treeHash(index)
      if (cacheObject[hash]) {
        snap = cacheObject[hash]
        snapIndex = index
        break
      }
    }
  }

  for (let index = snapIndex; index < operations.length; index += 1) {
    const operation = operations[index]
    const transform = transforms[operation.name](cloneDeep(snap), operation.data)
    const result = await Promise.resolve(transform)
    const hash = treeHash(index + 1)
    if (cacheObject)
      cacheObject[hash] = Object.freeze(result)

    snap = result
  }
  return snap
}

export function processOperations (operations: OperationOption[], hashFunction = ObjectHash.sha1): TransOperation[] {
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

export default class OperationSync<S> {
  base: Readonly<S>
  baseHash: string
  operations: TransOperation[]
  transforms: TransformFunctions<S>
  cache: SnapshotCache<S>

  constructor (baseSnapshot: S, transforms: TransformFunctions<S>, operations: OperationOption[] = []) {
    this.base = Object.freeze(baseSnapshot)
    this.baseHash = this.objectHash(this.base)
    this.transforms = transforms
    this.operations = []
    this.insertOperations(operations)
    this.cache = {}
  }

  objectHash (object: any) {
    return ObjectHash.sha1(object)
  }

  insertOperation (operation: OperationOption) {
    this.insertOperations([operation])
  }

  insertOperations (operations: OperationOption[]) {
    const processed = processOperations(operations, this.objectHash)
    this.operations = this.operations.concat(processed).sort((a, b) => a.timestamp - b.timestamp)
  }

  async eval (cache = true) {
    return await EvalTransforms(
      this.base,
      this.transforms,
      this.operations,
      this.objectHash,
      cache ? this.cache : undefined,
    )
  }
}
