import { ethers } from "hardhat";
import { Booster, Booster__factory, BunniVoterProxy, BunniVoterProxy__factory, CdxLIT, CdxLIT__factory, CdxRewardPool, CdxRewardPool__factory, CodexToken, CodexToken__factory, ExtraRewardStashV3__factory, IERC20, IERC20__factory, LITDepositor, LITDepositor__factory, PoolManagerProxy, PoolManagerProxy__factory, PoolManagerSecondaryProxy, PoolManagerSecondaryProxy__factory, PoolManagerV4, PoolManagerV4__factory, ProxyFactory, ProxyFactory__factory, RewardFactory, RewardFactory__factory, StashFactoryV2, StashFactoryV2__factory, StashTokenWrapper__factory, TokenFactory, TokenFactory__factory } from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const BALANCER_20WETH_80LIT = '0x9232a548DD9E81BaC65500b5e0d918F8Ba93675C';
const OLIT = "0x627fee87d0D9D2c55098A06ac805Db8F98B158Aa";

export type ContractsSetup = {
    deployer: SignerWithAddress;
    multisig: SignerWithAddress;
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
}

export const setupContracts = async (): Promise<ContractsSetup> => {
    const [deployer, multisig] = await ethers.getSigners();

    const want = IERC20__factory.connect(BALANCER_20WETH_80LIT, deployer);
    const oLIT = IERC20__factory.connect(OLIT, deployer);

    const voterProxy = await new BunniVoterProxy__factory(deployer).deploy();
    await voterProxy.deployed();

    const cdx = await new CodexToken__factory(deployer).deploy(
        voterProxy.address
    );
    await cdx.deployed();

    const booster = await new Booster__factory(deployer).deploy(
        voterProxy.address, cdx.address
    );
    await booster.deployed();

    await (await voterProxy.setOperator(booster.address)).wait();
    await (await cdx.updateOperator()).wait();

    const cdxLIT = await new CdxLIT__factory(deployer).deploy();
    await cdxLIT.deployed();
    const litDepositor = await new LITDepositor__factory(deployer).deploy(
        voterProxy.address, cdxLIT.address
    )
    await litDepositor.deployed();
    await (await cdxLIT.setOperator(litDepositor.address)).wait();
    await (await voterProxy.setDepositor(litDepositor.address)).wait();

    const poolManagerProxy = await new PoolManagerProxy__factory(deployer).deploy(
        booster.address
    )
    await poolManagerProxy.deployed();
    const poolManagerSecondaryProxy = await new PoolManagerSecondaryProxy__factory(deployer).deploy(
        booster.address,
        poolManagerProxy.address
    )
    await poolManagerSecondaryProxy.deployed();
    await (await poolManagerProxy.setOperator(poolManagerSecondaryProxy.address)).wait();
    const poolManagerV4 = await new PoolManagerV4__factory(deployer).deploy(
        poolManagerSecondaryProxy.address
    )
    await poolManagerV4.deployed();
    await (await poolManagerSecondaryProxy.setOperator(poolManagerV4.address)).wait();
    await (await booster.setPoolManager(poolManagerProxy.address)).wait();

    const tokenFactory = await new TokenFactory__factory(deployer).deploy(booster.address);
    await tokenFactory.deployed();
    const rewardFactory = await new RewardFactory__factory(deployer).deploy(booster.address);
    await rewardFactory.deployed();
    const proxyFactory = await new ProxyFactory__factory(deployer).deploy();
    await proxyFactory.deployed();
    const stashFactory = await new StashFactoryV2__factory(deployer).deploy(
        booster.address,
        rewardFactory.address,
        proxyFactory.address
    );
    await stashFactory.deployed();
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

    const cdxRewardPool = await new CdxRewardPool__factory(deployer).deploy(
        cdx.address,
        oLIT.address,
        booster.address,
        deployer.address
    );

    // transfer ownership to multisig
    await (await booster.setFeeManager(multisig.address)).wait();
    await (await voterProxy.setOwner(multisig.address)).wait();
    await (await poolManagerProxy.setOwner(multisig.address)).wait();
    await (await poolManagerSecondaryProxy.setOwner(multisig.address)).wait();
    await (await poolManagerV4.setOperator(multisig.address)).wait();

    return {
        deployer,
        multisig,
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
    };
}