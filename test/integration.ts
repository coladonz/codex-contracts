import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractsSetup, addGauges, setupContracts } from "./setup"
import { IERC20, ISmartWalletChecker__factory } from "../types";
import { BUNNI_SMART_WALLET_CHECKER, whales } from "./config";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { expect } from "chai";

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

describe("Integration", () => {
    let setup: ContractsSetup

    beforeEach(async () => {
        setup = await setupContracts();

        await addGauges(setup);

        // (IMPORTANT) Ask Bunni to whitelist voter proxy address
        const smartWalletChecker = ISmartWalletChecker__factory.connect(BUNNI_SMART_WALLET_CHECKER, setup.deployer);
        await network.provider.send("hardhat_setBalance", [
            await smartWalletChecker.owner(),
            "0x1000000000000000000",
        ]);
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [await smartWalletChecker.owner()],
        });
        const smartWalletCheckerOwner = await ethers.getSigner(await smartWalletChecker.owner());
        await smartWalletChecker.connect(smartWalletCheckerOwner).allowlistAddress(setup.voterProxy.address);
    })

    it("convert for cdxLIT", async () => {
        const amount = ethers.utils.parseEther("1");
        await prepareAssetsFromWhale(
            setup.alice,
            setup.want,
            amount
        );

        await setup.want.connect(setup.alice).approve(setup.litDepositor.address, amount);
        await setup.litDepositor.connect(setup.alice)["deposit(uint256,bool)"](
            amount,
            false
        );

        expect(await setup.cdxLIT.balanceOf(setup.alice.address)).to.equal(amount.mul(999).div(1000));
    })

    it("convert for cdxLIT and stake", async () => {
        const amount = ethers.utils.parseEther("1");
        await prepareAssetsFromWhale(
            setup.alice,
            setup.want,
            amount
        );

        await setup.want.connect(setup.alice).approve(setup.litDepositor.address, amount);
        await setup.litDepositor.connect(setup.alice)["deposit(uint256,bool,address)"](
            amount,
            false,
            setup.cdxLITRewardPool.address
        );

        expect(await setup.cdxLIT.balanceOf(setup.alice.address)).to.equal(0);
        expect(await setup.cdxLITRewardPool.balanceOf(setup.alice.address)).to.equal(amount.mul(999).div(1000));
    })

    it("stake cdx", async () => {
        const amount = ethers.utils.parseEther("1");
        await setup.cdx.transfer(setup.alice.address, amount);

        await setup.cdx.connect(setup.alice).approve(setup.cdxRewardPool.address, amount);
        await setup.cdxRewardPool.connect(setup.alice).stake(amount);

        expect(await setup.cdxRewardPool.balanceOf(setup.alice.address)).to.equal(amount);
    })

    it("lock cdx", async () => {
        const amount = ethers.utils.parseEther("1");
        await setup.cdx.transfer(setup.alice.address, amount);

        await setup.cdx.connect(setup.alice).approve(setup.cdxLocker.address, amount);
        await setup.cdxLocker.connect(setup.alice).lock(setup.alice.address, amount, 0);

        expect(await setup.cdxLocker.lockedBalanceOf(setup.alice.address)).to.equal(amount);
    })
});
