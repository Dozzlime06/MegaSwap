export const MEGAETH_CHAIN_ID = 4326;
export const MEGAETH_RPC = 'https://mainnet.megaeth.com/rpc';

export const USDM_ADDRESS = '0xac14f1b326362ec81f7230e5ac1247f7b5db3cf3';
export const SWAP_ADDRESS = '0x043406e193c47d8976710f8a04774f7d6980bfca';

export const USDM_ABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export const SWAP_ABI = [
  { inputs: [], name: 'manualPrice', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getETHPrice', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'swapFee', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'ethAmount', type: 'uint256' }], name: 'calculateUSDMOut', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'usdmAmount', type: 'uint256' }], name: 'calculateETHOut', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'swapETHForUSDM', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: 'usdmAmount', type: 'uint256' }], name: 'swapUSDMForETH', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;
