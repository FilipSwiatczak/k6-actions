import k6 from "k6/http";

class LoggingO {
    print = (__ENV.DEBUG && __ENV.DEBUG.toString() === 'true');
}

const Logging = new LoggingO();
export default Logging;