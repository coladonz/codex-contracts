import { ethers, network } from "hardhat";
import { IERC20, IERC20__factory } from "../types";
import { BALANCER_20WETH_80LIT, whales } from "../test/config";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

export const prepareAssetsFromWhale = async (signer: SignerWithAddress, asset: IERC20, amount: BigNumber) => {
    const whaleInfo = whales.find(item => item.asset.toLowerCase() == asset.address.toLowerCase());
    if (!whaleInfo) {
        throw new Error(`Whale for ${asset.address} not found!`);
    }

    await network.provider.send("hardhat_setBalance", [
        whaleInfo.whale,
        "0x1000000000000000000",
    ]);
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whaleInfo.whale],
    });
    const whale = await ethers.getSigner(whaleInfo.whale);

    await (await asset.connect(whale).transfer(signer.address, amount)).wait();
}
const main = async () => {
    const [deployer] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("1");
    const want = IERC20__factory.connect(BALANCER_20WETH_80LIT, deployer);
    await prepareAssetsFromWhale(
        deployer,
        want,
        amount
    );
}

main()