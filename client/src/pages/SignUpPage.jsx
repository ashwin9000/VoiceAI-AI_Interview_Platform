import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { BrainCircuit, User, Mail, Lock } from 'lucide-react';

const SignUpPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    const result = await signup({
      username: data.username,
      email: data.email,
      password: data.password,
    });

    if (result.success) {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h2 className="text-3xl font-bold text-[#000666] mb-2">AIVision</h2>
        <p className="text-[#767683]">Empowering human potential.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 sm:p-10">
          <h1 className="text-2xl font-bold text-[#191c1e] mb-8">Create Account</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div>
              <label className="text-sm font-semibold text-[#191c1e] mb-1.5 block">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c6c5d4]" />
                <input
                  {...register('username', {
                    required: 'Username is required',
                    minLength: { value: 3, message: 'At least 3 characters' },
                  })}
                  type="text"
                  placeholder="Enter your username"
                  className="input-field pl-11"
                />
              </div>
              {errors.username && (
                <p className="text-xs text-[#ba1a1a] mt-1">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-semibold text-[#191c1e] mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c6c5d4]" />
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  type="email"
                  placeholder="Enter your email"
                  className="input-field pl-11"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-[#ba1a1a] mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-semibold text-[#191c1e] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c6c5d4]" />
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'At least 6 characters' },
                  })}
                  type="password"
                  placeholder="Create a password"
                  className="input-field pl-11"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-[#ba1a1a] mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl text-base font-semibold text-white bg-[#4e45d5] hover:bg-[#3d35b5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Account...
                </div>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-sm text-[#767683] text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#000666] hover:text-[#4e45d5] transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
