const frida = require('frida')
const fridaLoad = require('frida-load')
const Cache = require('./cache')
const RpcHandler = require('./rpc')
const { serializeDevice, serializeApp, retry, FridaUtil } = require('./utils')


const io = require('socket.io')({ path: '/msg' })
const channels = {}
for (let namespace of ['devices', 'session', 'shell']) {
  channels[namespace] = io.of('/' + namespace)
}

const deviceMgr = frida.getDeviceManager()
deviceMgr.events.listen('added', async device => channels.devices.emit('deviceAdd', serializeDevice(device)))
deviceMgr.events.listen('removed', async device => channels.devices.emit('deviceRemove', serializeDevice(device)))


channels.session.on('connection', async(socket) => {
  let { device, bundle } = socket.handshake.query

  let dev, session, app, agent
  let cache = new Cache()

  if (!device || !bundle) {
    socket.emit('err', 'invalid parameters')
    socket.disconnect(true)
    return
  }

  try {
    dev = await frida.getDevice(device)
    if (dev.type != 'tether')
      throw new Error('device not found')

    socket.emit('device', serializeDevice(dev))
    let apps = await dev.enumerateApplications()
    app = apps.find(app => app.identifier == bundle)
    if (!app)
      throw new Error('app not installed')

    socket.emit('app', serializeApp(app))

    if (app.pid) {
      let front = await dev.getFrontmostApplication()
      if (front && front.pid == app.pid) {
        session = await dev.attach(app.name)
      } else {
        // if running background, restart it
        await dev.kill(app.pid)
        session = await FridaUtil.spawn(dev, app)
      }
    } else {
      session = await FridaUtil.spawn(dev, app)
    }

  } catch (ex) {
    socket.emit('error', ex)
    console.error(ex)
    socket.disconnect(true)
    return
  }

  session.events.listen('detached', reason => {
    socket.emit('detached', reason)
    socket.disconnect(true)
  })

  socket.on('detach', async data => {
    socket.disconnect()
  }).on('kill', async(data, ack) => {
    let pid = session.pid
    await session.detach()
    await dev.kill(pid)
    ack(true)
    socket.disconnect()
  }).on('disconnect', async() => {
    await session.detach()
  }).on('script', async({ source }, ack) => {
    try {
      let userScript = await session.createScript(source)
      try {
        await script.load()
        script.events.listen('message', (message, data) => {
          let { type, payload } = message
          // note: data is now ignored
          if (type == 'send') {
            socket.emit('send', payload)
          } else if (type == 'error') {
            socket.emit('error', payload)
          }
        })
      } catch (ex) {
        return ack({
          status: 'error',
          reason: 'failed to execute script',
          error: ex,
        })
      }
    } catch (ex) {
      return ack({
        status: 'error',
        reason: 'failed to compile script',
        error: ex,
      })
    }
    ack({ status: 'ok' })
  })

  let rpcHandler = new RpcHandler(session, socket)
  await rpcHandler.load()
  socket.emit('ready')

  return socket
})

exports.attach = server => io.attach(server)