import { Context } from '../types.js'

export default (ctx: Context): Context => {
    if(ctx.args.execCommand && !ctx.options.userName && !ctx.options.accessKey) {
        for(const arg of ctx.args.execCommand) {
            if(arg.includes('lambdaTestUserName')) {
                ctx.env.LT_USERNAME = arg.split('=')[1];
            }
            if(arg.includes('lambdaTestAccessKey')) {
                ctx.env.LT_ACCESS_KEY = arg.split('=')[1];
            }
        }
    }
    return ctx;
}