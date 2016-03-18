import passport from 'koa-passport';

export default (ctx, next) =>
  passport.authenticate('jwt', (user) => {
    if (user) {
      ctx.user = user;

      next();
      return;
    }

    ctx.status = 403;
    ctx.cookies.set('jwt', '');
    ctx.body = { error: 'auth.login.error.password.invalid' };
  })(ctx, next);
