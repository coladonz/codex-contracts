import { ContractsSetup, setupContracts } from "./setup"

describe("Integration", () => {
    let setup: ContractsSetup

    before(async () => {
        setup = await setupContracts();
    })

    it("initialize", async () => {

    })
});
