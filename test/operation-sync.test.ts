import OperationSync from "../src/operation-sync"

describe("demo", () => {
  it("basic", async () => {
    type Snap = {
      name: string
    }
    const snap = { name: 'hello' } as Snap

    const ops = new OperationSync<Snap>(snap, {
      upper(S) {
        S.name = S.name.toUpperCase()
        return S
      }
    }, [{
      action: 'upper',
      timestamp: +new Date(),
      hash: '123124',
    }])

    expect(await ops.eval()).toEqual({ name: 'HELLO' })
    // should be immutable
    expect(snap).toEqual({ name: 'hello' })
  })
})
