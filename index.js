const { stringToPath } = require('@cosmjs/crypto');
const { DirectSecp256k1HdWallet, coin } = require('@cosmjs/proto-signing');
const { SigningStargateClient, GasPrice, calculateFee } = require('@cosmjs/stargate');
const bech32Converter = require('bech32-converting');

require('dotenv').config();

const MNEMONIC = process.env.MNEMONIC || '';
const COSMOS_RPC_URL = process.env.COSMOS_RPC_URL || '';

const GAS_PRICE = {
  mpx: GasPrice.fromString('10000000000000mpx'),
  xfi: GasPrice.fromString('100000000000xfi'),
};
const PREFIX = 'mx';
const HD_PATHS = [stringToPath("m/44'/118'/0'/0/0"), stringToPath("m/44'/60'/0'/0/0")];

async function main() {
  const gasPrice = GAS_PRICE.xfi;
  const clientOptions = {
    gasPrice,
    broadcastTimeoutMs: 5000,
    broadcastPollIntervalMs: 1000,
  };

  const signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: PREFIX, hdPaths: HD_PATHS });
  const signingClient = await SigningStargateClient.connectWithSigner(COSMOS_RPC_URL, signer, clientOptions);
  const [oldAddressAccountData, newAddressAccountData] = await signer.getAccounts();

  console.log('old address:', oldAddressAccountData.address);
  console.log('new address:', newAddressAccountData.address);
  console.log('new evm address:', bech32Converter(PREFIX).toHex(newAddressAccountData.address), '\n');

  const newAddressBalances = await signingClient.getAllBalances(newAddressAccountData.address);
  console.log('new address balance:', newAddressBalances);

  const oldAddressBalances = await signingClient.getAllBalances(oldAddressAccountData.address);
  console.log('old address balance:', oldAddressBalances, '\n');

  const recipient = 'mx1gza5y94kal25eawsenl56th8kdyujszmvmlxf0';
  const message = {
    typeUrl: '/cosmos.bank.v1beta1.MsgSend',
    value: {
      fromAddress: newAddressAccountData.address,
      toAddress: recipient,
      amount: [coin('1000000000000000000', 'mpx')],
    },
  };

  try {
    const gasEstimate = await signingClient.simulate(newAddressAccountData.address, [message], '');
    const gasLimit = Math.round(gasEstimate * '1.4');
    const stdFee = calculateFee(gasLimit, gasPrice);
    console.log('stdFee', stdFee);

    const tx = await signingClient.signAndBroadcast(newAddressAccountData.address, [message], stdFee);
    console.log('tx', tx);
  } catch (e) {
    console.error(e);
  }
}

main();
