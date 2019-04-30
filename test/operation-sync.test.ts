import OperationSync, { Transforms, EvalTransforms, processOperations } from '../src/operation-sync'

let transformCount = 0

interface Snap {
  name: string
}

const transforms: Transforms<Snap> = {
  upper(snap) {
    transformCount += 1
    snap.name = snap.name.toUpperCase()
    return snap
  },
  lower (snap){
    transformCount += 1
    snap.name = snap.name.toLowerCase()
    return snap
  },
  slice(snap, args){
    transformCount += 1
    const arg = args as number[]
    snap.name = snap.name.slice(...arg)
    return snap
  },
  prepend(snap, data) {
    transformCount += 1
    snap.name = data+ snap.name
    return snap
  },
}

describe('demo', () => {

  it('no operation', async () => {
    const snap: Snap = { name: 'hello' } 
    const ops = new OperationSync<Snap>(snap, transforms)
    expect(await ops.eval()).toEqual(snap)
  })

  it('basic', async () => {
 
    const snap: Snap = { name: 'hello' }
    
    const ops = new OperationSync<Snap>(snap, transforms, [{ action: 'upper' }])

    expect(ops.objectHash(snap)).toEqual(ops.baseHash)

    expect(await ops.eval()).toEqual({ name: 'HELLO' })
    // should be immutable
    expect(snap).toEqual({ name: 'hello' })

    ops.insertOperation({ action: 'lower' })
    expect(await ops.eval()).toEqual({ name: 'hello' })

    ops.insertOperation({ action: 'slice', data: [1] })
    expect(await ops.eval()).toEqual({ name: 'ello' })
  })

  it('string transform', async() => {
    const snap: Snap = { name: 'hello' } 

    const ops = new OperationSync<Snap>(snap, transforms, ['upper'])

    expect(await ops.eval()).toEqual({ name: 'HELLO' })

    ops.insertOperation('lower')
    expect(await ops.eval()).toEqual({ name: 'hello' })
  })

  it('cache on', async() => {
    const snap: Snap = { name: 'hello' }

    transformCount = 0
    const ops = new OperationSync<Snap>(snap, transforms, ['upper'])

    await ops.eval()
    expect(transformCount).toEqual(1)

    // use 1 cache, should only execute transform once
    transformCount = 0
    ops.insertOperation('lower')
    await ops.eval()
    expect(transformCount).toEqual(1)

    // use cache, should not execute any transforms
    transformCount = 0
    const snap1 = await ops.eval()
    expect(transformCount).toEqual(0)

    // consist result
    expect(await ops.eval()).toEqual(snap1)
    expect(await ops.eval()).toEqual(await ops.eval())
    expect(transformCount).toEqual(0)

    transformCount = 0
    // should have same result without cache
    expect(await ops.eval(false)).toEqual(snap1)
    expect(transformCount).toEqual(2)
  })

  it('cache off', async() => {
    const snap: Snap = { name: 'hello' } 

    const ops = new OperationSync<Snap>(snap, transforms, ['upper'])

    transformCount = 0
    await ops.eval(false)
    expect(transformCount).toEqual(1)
    expect(Object.keys(ops.cache)).toHaveLength(0)

    transformCount = 0
    await ops.eval(false)
    expect(transformCount).toEqual(1)
  })

  it('order1', async() => {
    const snap: Snap = { name: 'hello' }

    const ops = new OperationSync<Snap>(snap, transforms)

    ops.insertOperations([
      { action: 'prepend', data: '123' },
      { action: 'slice', data: [2] },
    ])

    expect(await ops.eval()).toEqual({ name: '3hello' })
  })

  it('order2', async() => {
    const snap: Snap = { name: 'hello' }

    const ops = new OperationSync<Snap>(snap, transforms)

    ops.insertOperations([
      { action: 'slice', data: [2] },
      { action: 'prepend', data: '123' },
    ])

    expect(await ops.eval()).toEqual({ name: '123llo' })
  })

  it('will sort by timestamp', async() => {
    const snap: Snap = { name: 'hello' }

    const ops = new OperationSync<Snap>(snap, transforms)

    ops.insertOperations([
      { action: 'slice', data: [2], timestamp: 2 },
      { action: 'prepend', data: '123', timestamp: 1 },
    ])

    expect(await ops.eval()).toEqual({ name: '3hello' })
  })

  it('insert to head will not use cache', async() => {
    const snap: Snap= { name: 'hello' } 

    const ops = new OperationSync<Snap>(snap, transforms)

    ops.insertOperations([
      { action: 'slice', data: [2], timestamp: 3 },
      { action: 'prepend', data: '123', timestamp: 2 },
    ])

    transformCount = 0
    expect(await ops.eval()).toEqual({ name: '3hello' })
    expect(transformCount).toBe(2)

    transformCount = 0
    ops.insertOperation({ action: 'upper', timestamp: 1 })
    expect(await ops.eval()).toEqual({ name: '3HELLO' })
    expect(transformCount).toBe(3)
  })

  it('functional', async () => {
    const snap: Snap = { name: 'hello' }

    const operations = processOperations(['upper'])
    const result = await EvalTransforms<Snap>(snap, transforms, operations)

    expect(snap).toEqual({ name: 'hello' })
    expect(result).toEqual({ name: 'HELLO' })
  })
})
