import * as Joi from 'joi';

export default () => {
  const schema = Joi.object()
    .keys({
      SECURITY_BCRYPT_ROUND: Joi.number().default(10).min(9).max(12),
      SECURITY_JWT_SECRET: Joi.string().required().min(10),
      SECURITY_JWT_TTL: Joi.number().required(),
      MONGO_URI: Joi.string().required(),
      REDIS_URL: Joi.string().required(),
    })
    .unknown(true);

  const { value, error } = schema.validate(process.env);
  if (error) {
    throw error;
  }

  return {
    mongodb: {
      url: value.MONGO_URI,
    },
    security: {
      bcryptRound: value.SECURITY_BCRYPT_ROUND,
      jwtSecret: value.SECURITY_JWT_SECRET,
      jwtTTL: value.SECURITY_JWT_TTL,
    },
    redis: {
      url: value.REDIS_URL,
    },
  };
};
