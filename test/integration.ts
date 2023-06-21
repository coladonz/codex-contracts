import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractsSetup, addGauges, setupContracts } from "./setup"
import { BaseRewardPool, IERC20, IERC20__factory, ISmartWalletChecker__factory } from "../types";
import { BUNNI_SMART_WALLET_CHECKER, gauges, whales } from "./config";
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
    let gaugeRewards: BaseRewardPool[];

    beforeEach(async () => {
        setup = await setupContracts();

        gaugeRewards = await addGauges(setup);

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

    it("deposit/withdraw bunni lp", async () => {
        const bunniLP = IERC20__factory.connect(gauges[0].bunniLp, setup.deployer);

        const amount = ethers.utils.parseEther("1");
        await prepareAssetsFromWhale(
            setup.alice,
            bunniLP,
            amount
        );

        await bunniLP.connect(setup.alice).approve(setup.booster.address, amount);
        await setup.booster.connect(setup.alice).deposit(
            0,
            amount,
            true
        );

        expect(await bunniLP.balanceOf(setup.alice.address)).to.equal(0);

        // increase 1 month
        await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 30]);
        await ethers.provider.send("evm_mine", []);

        await gaugeRewards[0].connect(setup.alice).withdrawAndUnwrap(
            amount,
            true
        );
        expect(await bunniLP.balanceOf(setup.alice.address)).to.equal(amount);

        expect(await setup.oLIT.balanceOf(setup.alice.address)).to.equal(0);
        expect(await setup.cdx.balanceOf(setup.alice.address)).to.equal(0);
    })
});
