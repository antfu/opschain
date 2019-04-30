import { cloneDeep } from 'lodash'

export type OperationTransform<S> = (snap: S, data?: any) => S | Promise<S>
export type OperationTransforms<S> = { [action: string]: OperationTransform<S> }
export type Operation = {
  action: string,
  data?: any,
  timestamp: number,
  hash: string,
}
export type SnapshotCache<S> = { [hast: string]: Readonly<S> }

export default class OperationSync<S> {

  base: Readonly<S>
  operations: Operation[]
  transforms: OperationTransforms<S>
  cache: SnapshotCache<S> 

  constructor (baseSnapshot: S, transforms: OperationTransforms<S> = {}, operations: Operation[] = []) {
    this.base = Object.freeze(baseSnapshot)
    this.transforms = transforms
    this.operations = operations
    this.cache = {}
  }

  async eval({ useCache = true, saveCache = true }={}) {
    let snap = this.base
    for (const operation of this.operations){
      const result = await Promise.resolve(this.transforms[operation.action](cloneDeep(snap), operation.data))
      const hash = operation.hash
      if (saveCache) {
        this.cache[hash] = Object.freeze(result)
      }
      snap = result
    }
    return snap
  }

}
