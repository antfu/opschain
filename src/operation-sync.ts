import { cloneDeep, concat, sortBy } from 'lodash'
import * as ObjectHash from 'object-hash'

export type TransformsData = Readonly<any>
export type OperationTransform<S> = (snap: S, data?: TransformsData) => S | Promise<S>
export type Transforms<S> = { [s:string]: OperationTransform<S> }
export interface Operation {
  action: string,
  data?: TransformsData,
  timestamp: number,
  hash: string,
}
export interface OperationOption  {
  action: string,
  data?: TransformsData,
  timestamp?: number,
}
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

  objectHash(object:any){
    return ObjectHash.sha1(object)
  }

  processOperation(operation: OperationOption): Operation {
    return this.processOperations([operation])[0]
  }

  processOperations(operations: OperationOption[]): Operation[] {
    return operations.map(operation=>{
      return {
        action: operation.action,
        data: operation.data,
        timestamp: operation.timestamp || + new Date(),
        hash: this.objectHash({  action: operation.action, data: operation.data })
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

  async eval({ useCache = true, saveCache = true }={}) {
    let snap = this.base
    for (const operation of this.operations){
      const transform = this.transforms[operation.action](cloneDeep(snap), operation.data)
      const result = await Promise.resolve(transform)
      const hash = operation.hash
      if (saveCache) {
        this.cache[hash] = Object.freeze(result)
      }
      snap = result
    }
    return snap
  }

}