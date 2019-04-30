import OperationSync, { Transforms } from "../src/operation-sync"

type Snap = {
  name: string
}

const transforms: Transforms<Snap> = {
  upper(snap) {
    snap.name = snap.name.toUpperCase()
    return snap
  },
  lower (snap){
    snap.name = snap.name.toLowerCase()
    return snap
  },
  slice(snap, args){
    const arg = args as number[]
    snap.name = snap.name.slice(...arg)
    return snap
  }
}

describe("demo", () => {
  it("basic", async () => {
 
    const snap = { name: 'hello' } as Snap
    
    const ops = new OperationSync<Snap>(snap, transforms, [{
      action: 'upper',
    }])

    expect(ops.objectHash(snap)).toEqual(ops.baseHash)

    expect(await ops.eval()).toEqual({ name: 'HELLO' })
    // should be immutable
    expect(snap).toEqual({ name: 'hello' })

    ops.insertOperation({ action:'lower' })
    expect(await ops.eval()).toEqual({ name: 'hello' })

    ops.insertOperation({ action:'slice', data: [1] })
    expect(await ops.eval()).toEqual({ name: 'ello' })
  })
})
