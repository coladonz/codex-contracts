import { ethers } from "hardhat";
import { BaseRewardPool, BaseRewardPool__factory, Booster, Booster__factory, BunniVoterProxy, BunniVoterProxy__factory, CdxLIT, CdxLIT__factory, CdxLockerV2, CdxLockerV2__factory, CdxRewardPool, CdxRewardPool__factory, CdxStakingProxyV2, CdxStakingProxyV2__factory, CodexToken, CodexToken__factory, ExtraRewardStashV3__factory, IERC20, IERC20__factory, LITDepositor, LITDepositor__factory, PoolManagerProxy, PoolManagerProxy__factory, PoolManagerSecondaryProxy, PoolManagerSecondaryProxy__factory, PoolManagerV4, PoolManagerV4__factory, ProxyFactory, ProxyFactory__factory, RewardFactory, RewardFactory__factory, StashFactoryV2, StashFactoryV2__factory, StashTokenWrapper__factory, TokenFactory, TokenFactory__factory } from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BALANCER_20WETH_80LIT, OLIT, gauges } from "./config";

export type ContractsSetup = {
    deployer: SignerWithAddress;
    multisig: SignerWithAddress;
    treasury: SignerWithAddress;
    alice: SignerWithAddress;
    bob: SignerWithAddress;
    voterProxy: BunniVoterProxy;
    want: IERC20,
    oLIT: IERC20,
    cdx: CodexToken;
    booster: Booster;
    cdxLIT: CdxLIT;
    litDepositor: LITDepositor;
    poolManagerProxy: PoolManagerProxy;
    poolManagerSecondaryProxy: PoolManagerSecondaryProxy;
    poolManagerV4: PoolManagerV4;
    tokenFactory: TokenFactory;
    rewardFactory: RewardFactory;
    proxyFactory: ProxyFactory;
    stashFactory: StashFactoryV2;
    cdxRewardPool: CdxRewardPool;
    cdxLITRewardPool: BaseRewardPool;
    cdxLocker: CdxLockerV2;
    cdxStakingProxy: CdxStakingProxyV2;
}

export const setupContracts = async (): Promise<ContractsSetup> => {
    const [deployer, multisig, treasury, alice, bob] = await ethers.getSigners();

    const want = IERC20__factory.connect(BALANCER_20WETH_80LIT, deployer);
    const oLIT = IERC20__factory.connect(OLIT, deployer);

    const voterProxy = await new BunniVoterProxy__factory(deployer).deploy();
    await voterProxy.deployed();
    console.log("VoterProxy deployed at", voterProxy.address);

    const cdx = await new CodexToken__factory(deployer).deploy(
        voterProxy.address
    );
    await cdx.deployed();
    console.log("CodexToken deployed at", cdx.address);

    // IMPORTANT: mint cdx for airdrop
    await (await cdx.mint(deployer.address, ethers.utils.parseEther('1000000'))).wait();
    console.log("1M CodexToken minted");

    const booster = await new Booster__factory(deployer).deploy(
        voterProxy.address, cdx.address
    );
    await booster.deployed();
    console.log("Booster deployed at", booster.address);

    await (await voterProxy.setOperator(booster.address)).wait();
    console.log("voterProxy.setOperator");
    await (await cdx.updateOperator()).wait();
    console.log("cdx.updateOperator");

    const cdxLIT = await new CdxLIT__factory(deployer).deploy();
    await cdxLIT.deployed();
    console.log("cdxLIT deployed at", cdxLIT.address);
    const litDepositor = await new LITDepositor__factory(deployer).deploy(
        voterProxy.address, cdxLIT.address
    )
    await litDepositor.deployed();
    console.log("LITDepositor deployed at", litDepositor.address);
    await (await cdxLIT.setOperator(litDepositor.address)).wait();
    console.log("cdxLIT.setOperator");
    await (await voterProxy.setDepositor(litDepositor.address)).wait();
    console.log("voterProxy.setDepositor");

    const poolManagerProxy = await new PoolManagerProxy__factory(deployer).deploy(
        booster.address
    )
    await poolManagerProxy.deployed();
    console.log("PoolManagerProxy deployed at", poolManagerProxy.address);
    const poolManagerSecondaryProxy = await new PoolManagerSecondaryProxy__factory(deployer).deploy(
        booster.address,
        poolManagerProxy.address
    )
    await poolManagerSecondaryProxy.deployed();
    console.log("PoolManagerSecondaryProxy deployed at", poolManagerSecondaryProxy.address);
    await (await poolManagerProxy.setOperator(poolManagerSecondaryProxy.address)).wait();
    console.log("poolManagerProxy.setOperator");
    const poolManagerV4 = await new PoolManagerV4__factory(deployer).deploy(
        poolManagerSecondaryProxy.address
    )
    await poolManagerV4.deployed();
    console.log("PoolManagerV4 deployed at", poolManagerV4.address);
    await (await poolManagerSecondaryProxy.setOperator(poolManagerV4.address)).wait();
    console.log("poolManagerSecondaryProxy.setOperator");
    await (await booster.setPoolManager(poolManagerProxy.address)).wait();
    console.log("booster.setPoolManager");

    const tokenFactory = await new TokenFactory__factory(deployer).deploy(booster.address);
    await tokenFactory.deployed();
    console.log("TokenFactory deployed at", tokenFactory.address);
    const rewardFactory = await new RewardFactory__factory(deployer).deploy(booster.address);
    await rewardFactory.deployed();
    console.log("RewardFactory deployed at", rewardFactory.address);
    const proxyFactory = await new ProxyFactory__factory(deployer).deploy();
    await proxyFactory.deployed();
    console.log("ProxyFactory deployed at", proxyFactory.address);
    const stashFactory = await new StashFactoryV2__factory(deployer).deploy(
        booster.address,
        rewardFactory.address,
        proxyFactory.address
    );
    await stashFactory.deployed();
    console.log("StashFactory deployed at", stashFactory.address);
    const stashTokenWrapper = await new StashTokenWrapper__factory(deployer).deploy(booster.address);
    await stashTokenWrapper.deployed();
    const stashV3Implementation = await new ExtraRewardStashV3__factory(deployer).deploy(
        stashTokenWrapper.address,
        proxyFactory.address,
        cdx.address
    );
    await stashV3Implementation.deployed();
    await (await stashFactory.setImplementation(ethers.constants.AddressZero, ethers.constants.AddressZero, stashV3Implementation.address)).wait();
    await (await booster.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address)).wait();

    const cdxLITRewardPool = await new BaseRewardPool__factory(deployer).deploy(
        0,
        cdxLIT.address,
        oLIT.address,
        booster.address,
        rewardFactory.address,
    );
    await cdxLITRewardPool.deployed();
    const cdxRewardPool = await new CdxRewardPool__factory(deployer).deploy(
        cdx.address,
        oLIT.address,
        booster.address,
        deployer.address
    );
    await cdxRewardPool.deployed();
    await (await booster.setRewardContracts(cdxLITRewardPool.address, cdxRewardPool.address)).wait();
    await (await booster.setTreasury(treasury.address)).wait();

    const cdxLocker = await new CdxLockerV2__factory(deployer).deploy(
        cdx.address,
        cdxLIT.address,
        treasury.address,
        cdxLITRewardPool.address,
    );
    await cdxLocker.deployed();
    const cdxStakingProxy = await new CdxStakingProxyV2__factory(deployer).deploy(
        cdx.address,
        cdxLIT.address,
        cdxRewardPool.address,
        cdxLITRewardPool.address,
        litDepositor.address,
        cdxLocker.address
    );
    await cdxStakingProxy.deployed();
    await (await cdxStakingProxy.setCallIncentive(100)).wait();
    await (await cdxStakingProxy.setApprovals()).wait();
    await (await cdxLocker.setStakingContract(cdxStakingProxy.address)).wait();

    // transfer ownership to multisig
    await (await booster.setFeeManager(multisig.address)).wait();
    await (await voterProxy.setOwner(multisig.address)).wait();
    await (await poolManagerProxy.setOwner(multisig.address)).wait();
    await (await poolManagerSecondaryProxy.setOwner(multisig.address)).wait();
    await (await poolManagerV4.setOperator(multisig.address)).wait();

    return {
        deployer,
        multisig,
        treasury,
        alice,
        bob,
        want,
        oLIT,
        voterProxy,
        cdx,
        booster,
        cdxLIT,
        litDepositor,
        poolManagerProxy,
        poolManagerSecondaryProxy,
        poolManagerV4,
        tokenFactory,
        rewardFactory,
        proxyFactory,
        stashFactory,
        cdxRewardPool,
        cdxLITRewardPool,
        cdxLocker,
        cdxStakingProxy,
    };
}

export const addGauges = async (setup: ContractsSetup): Promise<BaseRewardPool[]> => {
    const result = []
    for (let i = 0; i < gauges.length; i++) {
        await (await setup.poolManagerV4.connect(setup.multisig)["addPool(address)"](
            gauges[i].gauge
        )).wait();
        result.push(
            BaseRewardPool__factory.connect(
                (await setup.booster.poolInfo(i)).oLITRewards, setup.deployer
            )
        )
    }
    return result;
}