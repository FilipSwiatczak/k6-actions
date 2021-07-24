import Test from "./Test"

Test.loadTestConfiguration();

export let options = Test.options;

export function setup() {
    return Test.setupHook();
}

export default function (setup: Object) {
    Test.run(setup);
}