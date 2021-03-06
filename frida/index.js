import checksec from './checksec'
import lsof from './lsof'
import imports from './imports'
import cookies from './binarycookie'
import urlOpen from './ipc'
import keychain from './keychain'

import { info } from './info'
import { classes, methods, inspect, proto } from './classdump'
import { tables, data, query } from './sqlite'
import { ls, home, plist, text, download } from './finder'
import { dumpWindow, toggleTouchID } from './ui'
import { hook, unhook, swizzle, unswizzle } from './hook'


toggleTouchID(false)
// hook('/usr/lib/libSystem.B.dylib', 'open', { args: ['char *', 'int'], ret: 'int'})
swizzle('NSURL', 'URLWithString_')
swizzle('NSString', 'stringWithContentsOfFile_usedEncoding_error_')


rpc.exports = {
  checksec,
  info,

  lsof,
  classes,
  methods,
  inspect,
  proto,
  imports,

  ls,
  home,
  plist,
  text,
  download,

  cookies,
  urlOpen,

  tables,
  data,
  query,

  dumpWindow,
  toggleTouchID,

  dumpKeyChain: keychain.list,

  hook,
  unhook,
  swizzle,
  unswizzle,
}