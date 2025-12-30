import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const MEGAETH_RPC = 'https://mainnet.megaeth.com/rpc';
const MEGAETH_CHAIN = {
  id: 4326,
  name: 'MegaETH Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [MEGAETH_RPC] } },
};

const SWAP_CONTRACT = process.env.USDM_SWAP_ADDRESS || '';

const SWAP_ABI = parseAbi([
  'function setManualPrice(uint256 _price) external',
  'function manualPrice() view returns (uint256)',
  'function getETHPrice() view returns (uint256)',
]);

async function getETHPriceFromAPI(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum.usd;
  } catch (e) {
    // Fallback to Binance
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
    const data = await response.json();
    return parseFloat(data.price);
  }
}

async function updatePrice() {
  const privateKey = process.env.Private_key;
  if (!privateKey) {
    console.error('Set Private_key in environment');
    return;
  }

  if (!SWAP_CONTRACT) {
    console.error('Set USDM_SWAP_ADDRESS in environment');
    return;
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  
  const publicClient = createPublicClient({
    chain: MEGAETH_CHAIN as any,
    transport: http(MEGAETH_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: MEGAETH_CHAIN as any,
    transport: http(MEGAETH_RPC),
  });

  // Get current price from API
  const ethPrice = await getETHPriceFromAPI();
  console.log(`Current ETH Price: $${ethPrice.toFixed(2)}`);

  // Convert to 8 decimals (Chainlink format)
  const priceWith8Decimals = BigInt(Math.round(ethPrice * 1e8));
  console.log(`Price in 8 decimals: ${priceWith8Decimals}`);

  // Get current contract price
  const currentPrice = await publicClient.readContract({
    address: SWAP_CONTRACT as `0x${string}`,
    abi: SWAP_ABI,
    functionName: 'manualPrice',
  });
  console.log(`Contract current price: $${Number(currentPrice) / 1e8}`);

  // Only update if price changed by more than 0.1%
  const priceDiff = Math.abs(Number(priceWith8Decimals) - Number(currentPrice)) / Number(currentPrice);
  if (priceDiff < 0.001) {
    console.log('Price change < 0.1%, skipping update');
    return;
  }

  // Update price on contract
  const hash = await walletClient.writeContract({
    address: SWAP_CONTRACT as `0x${string}`,
    abi: SWAP_ABI,
    functionName: 'setManualPrice',
    args: [priceWith8Decimals],
  });

  console.log(`Price updated! Tx: ${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
}

// Run continuously (every 30 seconds)
async function main() {
  console.log('Price Updater Started');
  console.log('Updates price every 30 seconds from CoinGecko\n');
  
  while (true) {
    try {
      await updatePrice();
    } catch (e: any) {
      console.error('Update failed:', e.message);
    }
    await new Promise(r => setTimeout(r, 30000)); // 30 seconds
  }
}

main();
