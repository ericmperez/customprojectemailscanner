# Deploying Dashboard to Vercel

This guide explains how to deploy the Licitaciones Dashboard to Vercel for free.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup) (free)
2. [Vercel CLI](https://vercel.com/cli) installed: `npm i -g vercel`
3. Your Supabase credentials (URL and Key)

## Deployment Steps

### Option 1: Deploy via Vercel CLI (Recommended)

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Set Environment Variables**
   
   Before deploying, you need to add your Supabase credentials as Vercel secrets:
   
   ```bash
   vercel env add SUPABASE_URL
   # Paste your Supabase URL when prompted
   
   vercel env add SUPABASE_KEY
   # Paste your Supabase service role key when prompted
   ```

3. **Deploy to Vercel**
   ```bash
   vercel
   ```
   
   - First deployment will ask you to link to an existing project or create a new one
   - Choose "Create new project"
   - Accept the default settings
   - Vercel will build and deploy your dashboard

4. **Deploy to Production**
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Dashboard (Git Integration)

1. **Push your code to GitHub/GitLab/Bitbucket**
   ```bash
   git add vercel.json .vercelignore
   git commit -m "Add Vercel configuration"
   git push origin main
   ```

2. **Import Project in Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Select your Git repository
   - Vercel will auto-detect the configuration

3. **Add Environment Variables**
   - In project settings, go to "Environment Variables"
   - Add these variables:
     - `SUPABASE_URL` = Your Supabase project URL
     - `SUPABASE_KEY` = Your Supabase service role key
   - Save and redeploy

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your dashboard

## Configuration

The `vercel.json` file configures:
- **Builds**: Uses `@vercel/node` for the Express server
- **Routes**: Directs all API and web traffic to the dashboard server
- **Environment**: References to environment variables

## Accessing Your Dashboard

After deployment, Vercel will provide you with a URL like:
```
https://your-project-name.vercel.app
```

The dashboard will be available at:
- **Dashboard UI**: `https://your-project-name.vercel.app`
- **API**: `https://your-project-name.vercel.app/api`

## Custom Domain (Optional)

To use a custom domain:

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow Vercel's DNS configuration instructions

## Environment Variables

Required environment variables for production:

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `SUPABASE_KEY` | Your Supabase service role key | ✅ Yes |
| `NODE_ENV` | Set to `production` | Auto-set |

## Updating Your Deployment

### Via CLI
```bash
vercel --prod
```

### Via Git Integration
Simply push to your main branch:
```bash
git push origin main
```

Vercel will automatically rebuild and redeploy.

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify environment variables are set correctly

### API Not Working

1. Verify `SUPABASE_URL` and `SUPABASE_KEY` are set
2. Check that your Supabase table exists
3. Review function logs in Vercel dashboard

### Static Files Not Loading

1. Ensure files are in `src/dashboard/public/`
2. Check `.vercelignore` isn't excluding needed files
3. Verify routes in `vercel.json`

## Cost

Vercel's **Hobby (Free) Plan** includes:
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth per month
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Serverless functions

This is more than enough for a dashboard viewing licitaciones.

## Performance Considerations

Vercel runs your Express app as serverless functions:
- **Cold starts**: First request may be slower (~1-2 seconds)
- **Warm functions**: Subsequent requests are fast
- **Automatic scaling**: Handles traffic spikes automatically

## Security Notes

1. **Never commit `.env` files** - Use Vercel's environment variables
2. **Use service role key** - Required for Supabase operations
3. **CORS is enabled** - Consider restricting origins in production
4. **HTTPS is automatic** - All traffic is encrypted

## Monitoring

Monitor your dashboard:
- **Vercel Analytics**: Track performance and usage
- **Function Logs**: View API logs in Vercel dashboard
- **Supabase Dashboard**: Monitor database queries

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Supabase Documentation](https://supabase.com/docs)

---

**Note**: The Gmail processing agent (`npm start`) still needs to run locally or on a server since it requires continuous execution and Gmail API access. Only the dashboard is deployed to Vercel.
