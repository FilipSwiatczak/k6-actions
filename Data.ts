import {ScnarioI} from "./index";
import Logging from "./Logging";

export enum UserAssignment {FIXED = 'FIXED', PROGRESSIVE = 'PROGRESSIVE', RANDOM = 'RANDOM'}

class DataO {
    protected dataMap = new Map<string, Object>();
    protected scenarioMap = new Map<string, Object>();
    defaultData = {
        source: "sampleData",
        splitArray: true,
        splitsNum: 100,
        mainArray: 'users',
        mainName: 'username',
        userAssignment: UserAssignment.PROGRESSIVE
    };

    inject(scenarioName: string, vuID: number, iter: number): any {
        const journeyData: any = {...this.dataMap.get(scenarioName)};
        const dataConfig: any = this.scenarioMap.get(scenarioName);

        journeyData[dataConfig.data.mainName] = dataConfig.data.userAssignment === UserAssignment.FIXED
            ? journeyData[dataConfig.data.mainArray[0]]
            : journeyData[dataConfig.data.mainArray][(((vuID * 100) + iter) % journeyData[dataConfig.data.mainArray].length)]; // PROGRESSIVE as default

        return journeyData;
    }

    loadScenarioLevelData(scenMap: Map<string, ScenarioI>) {
        this.scenarioMap = scenMap;
        const dataPath = './projectFiles/data/';
        if (Logging.print) console.log('[' + __VU + ']: Loading Scenario level data');
        for (const key of scenMap.keys()){
            if (!this.dataMap.has(key)) {
                const scenario: any = scenMap.get(key);
                if (scenario.data.splitArray){
                    const splits = scenario.data.splitsNum;
                    let data = (function () {
                        const all_data = require('./projectFiles/data/' + scenario.data.source + '.json');

                        let user_size, index, vUsers, all_users = all_data[scenario.data.mainArray];
                        if (all_users && all_users.length > 0) {
                            if (all_users.length >= splits) {   // total number of users is divided in equal chunks based on number of splits provided
                                user_size = Math.floor(all_users.length / splits);
                                index = user_size * ((__VU) % splits);
                            } else {  // if max VU count > splits, max VU count is taken as divisor
                                if (scenario.k6ScenarioBlock.vus) {vUsers = scenario.k6ScenarioBlock.vus} else {
                                    vUsers = scenario.k6ScenarioBlock.stages.map((stage: any) => stage.target).reduce((a: number, b: number) => Math.max(a, b));
                                }
                                if (Logging.print) console.log('[' + __VU + '] larger than user pool ['
                                + all_users.length + ']. Dividing by number of total VUs -> [' + vUsers + ']');
                                user_size = Math.floor(all_users.length / vUsers);
                                if (user_size < 1) user_size = 1;
                                index = user_size * ((__VU-1) % all_users.length);
                            }
                            all_data[scenario.data.mainArray] = all_users.slice(index, index + user_size); // final reduced array is being reassigned
                        }
                        return all_data;
                    })();
                    this.dataMap.set(key, data);
                    if (Logging.print) console.log('[' + __VU + ']: Data loaded for ' + key + ', no of entries: ' + data[scenario.data.mainArray].length);
                } else {
                    this.dataMap.set(key, require(dataPath + scenario.data.source + '.json'));
                }
            }
        }
    }
}

const Data = new DataO();
export default Data;  // this two line gimmick allows IDEs to autofill as you type instead of having to write your own import