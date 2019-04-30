import { cloneDeep, concat, sortBy } from 'lodash'
import * as ObjectHash from 'object-hash'

export type TransformsData = Readonly<any> | string
export type OperationTransform<S> = (snap: S, data?: TransformsData) => S | Promise<S>
export type Transforms<S> = { [s:string]: OperationTransform<S> }
export interface Operation {
  action: string,
  data?: Readonly<any>,
  timestamp: number,
  hash: string,
}
export type OperationOption = {
  action: string,
  data?: any,
  timestamp?: number,
} | string
export type SnapshotCache<S> = { [hast: string]: Readonly<S> }


export default class OperationSync<S> {

  base: Readonly<S>
  baseHash: String
  operations: Operation[]
  transforms: Transforms<S>
  cache: SnapshotCache<S> 

  constructor (baseSnapshot: S, transforms: Transforms<S>, operations: OperationOption[] = []) {
    this.base = Object.freeze(baseSnapshot)
    this.baseHash = this.objectHash(this.base)
    this.transforms = transforms
    this.operations = this.processOperations(operations)
    this.cache = {}
  }

  objectHash(object:any) {
    return ObjectHash.sha1(object)
  }

  processOperations(operations: OperationOption[]): Operation[] {
    return operations.map(operation=>{
      if (typeof operation === 'string') {
        return {
          action: operation,
          timestamp: + new Date(),
          hash: this.objectHash({  action: operation })
        }
      }
      else {
        return {
          action: operation.action,
          data: Object.freeze(operation.data),
          timestamp: operation.timestamp || + new Date(),
          hash: this.objectHash({  action: operation.action, data: operation.data })
        }
      }
    })
  }

  insertOperation(operation: OperationOption) {
    this.insertOperations([operation])
  }

  insertOperations(operations: OperationOption[]) {
    const processed = this.processOperations(operations)
    this.operations = sortBy(concat(this.operations, processed), 'timestamp')
  }

  treeHash(operationIndex: number) {
    const operationHashes = this.operations.slice(0, operationIndex).map(op=>op.hash)
    return this.objectHash({ 
      baseHash: this.baseHash,
      operations: operationHashes 
    })
  }

  async eval({ useCache = true, saveCache = true }={}) {
    let snap = this.base
    let snapIndex = 0

    if (useCache) {
      // search revere
      for (let index = this.operations.length; index >= 0 ; index -= 1 ) {
        const hash = this.treeHash(index)
        if (this.cache[hash]) {
          snap = this.cache[hash]
          snapIndex = index
          break
        }
      }
    }

    for (let index = snapIndex; index < this.operations.length; index +=1 ) {
      const operation = this.operations[index]
      const transform = this.transforms[operation.action](cloneDeep(snap), operation.data)
      const result = await Promise.resolve(transform)
      const hash = this.treeHash(index + 1)
      if (saveCache) {
        this.cache[hash] = Object.freeze(result)
      }
      snap = result
    }
    return snap
  }

}