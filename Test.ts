import Data from "./Data";
import scenarios from "./projectFiles/scenarios";
import {ScenarioI, Logging} from "./index";

// Scenario list as selected after parsing CLi arguments
let scenarioMap = new Map<string, ScenarioI>();

class Test {
    options: any = {
        insecureSkipTLSVerify: true
    };

    loadTestConfiguration(){
       // CLI can provide "," separated scenario names, including full RegExp
       const scenarioPatterns: string[] = __ENV.SCENARIO ? __ENV.SCENARIO.split(',') : [];
       let scenarioBlock: any = {}, thresholds: any = {};
       let scenarioNames: any = [];
       // we flatten scenarios object to an array of keys to test each pattern against
        for (let key in scenarios) scenarioNames.push(key);
        scenarioPatterns.forEach((pattern: string) => {
            // here RegExp filters scenarioNames by applying pattern test - passing scenarioNames are processed below
            scenarioNames.filter((text: string) => new RegExp(pattern).test(text)).forEach((scenarioName: string) => {
                if (scenarios[scenarioName]) {
                    scenarioBlock[scenarioName] = {...scenarios[scenarioName].k6ScenarioBlock, ...{env: {SCEN: scenarioName}}};
                    thresholds = {...thresholds, ...scenarios[scenarioName].thresholds};
                    scenarioMap.set(scenarioName, {
                        journey: scenarios[scenarioName].journey,
                        data: {...Data.defaultData, ...scenarios[scenarioName].data}, // merging default Data params with those provided
                        k6ScenarioBlock: scenarioBlock[scenarioName],
                    });
                } else {
                    console.warn(scenarioName + ' is not a valid scenario name. Pattern used: ' + pattern);
                }
            })
        });
        this.options.scenarios = scenarioBlock;
        this.options.thresholds = thresholds;

        Data.loadScenarioLevelData(scenarioMap);
        if (Logging.print) console.log('[' + __VU + ']: LOADING FINISHED');
    }

    setupHook(): Object {
        console.log('EXECUTION STARTS');
        return {};
    }

    run(_setup: Object) {
        scenarioMap.get(__ENV.SCEN)
            ?.journey.execute(_setup,
            Data.inject(__ENV.SCEN, __VU, __ITER));
    }
}

export default new Test();