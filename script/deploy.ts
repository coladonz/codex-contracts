import { addGauges, setupContracts } from "../test/setup"

const main = async () => {
    console.log("deploy start");

    const setup = await setupContracts();
    const gaugeRewards = await addGauges(setup);

    console.log("deploy done!")
}

main()